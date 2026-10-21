import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import FirebaseAuth
import Sentry
import react_native_config

// Native crash events do not pass through React Native's JavaScript beforeSend.
private enum HoystNativeMonitoring {
  static func initialize() {
#if !DEBUG
    let config = RNCConfig.env() as? [String: String] ?? [:]
    guard let dsn = config["SENTRY_DSN"], !dsn.isEmpty else { return }
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    SentrySDK.start { options in
      options.dsn = dsn
      options.environment = config["APP_ENV"] ?? "development"
      options.releaseName = "hoyst@\(version)+\(build)"
      options.dist = build
      options.sendDefaultPii = false
      options.tracesSampleRate = 0
      options.enableAutoSessionTracking = true
      options.attachScreenshot = false
      options.attachViewHierarchy = false
      options.enableAutoBreadcrumbTracking = false
      options.enableNetworkBreadcrumbs = false
      options.beforeBreadcrumb = { _ in nil }
      options.beforeSend = sanitize
    }
#endif
  }

  static func sanitize(_ event: Sentry.Event) -> Sentry.Event? {
    let safe = Sentry.Event(level: event.level)
    safe.eventId = event.eventId
    safe.timestamp = event.timestamp
    safe.platform = event.platform
    safe.releaseName = event.releaseName
    safe.dist = event.dist
    safe.environment = event.environment
    safe.sdk = event.sdk
    safe.debugMeta = event.debugMeta
    safe.tags = ["privacy_filter": "native-v1"]
    let allowed = [
      "app": ["app_identifier", "app_version", "app_build", "in_foreground"],
      "os": ["name", "version", "build", "kernel_version", "rooted"],
      "device": ["family", "model", "model_id", "arch", "simulator", "orientation"],
      "runtime": ["name", "version"]
    ]
    safe.context = allowed.reduce(into: [String: [String: Any]]()) { result, entry in
      guard let original = event.context?[entry.key] else { return }
      result[entry.key] = original.filter {
        entry.value.contains($0.key) && ($0.value is String || $0.value is NSNumber)
      }
    }
    safe.exceptions = event.exceptions?.map { original in
      let exception = Sentry.Exception(value: "Error details withheld for privacy", type: original.type)
      if let originalMechanism = original.mechanism {
        let mechanism = Sentry.Mechanism(type: originalMechanism.type)
        mechanism.handled = originalMechanism.handled
        exception.mechanism = mechanism
      }
      exception.threadId = original.threadId
      exception.stacktrace = sanitizeStack(original.stacktrace)
      return exception
    }
    safe.threads = event.threads?.map { original in
      let thread = SentryThread(threadId: original.threadId)
      thread.crashed = original.crashed
      thread.current = original.current
      thread.isMain = original.isMain
      thread.stacktrace = sanitizeStack(original.stacktrace)
      return thread
    }
    safe.stacktrace = sanitizeStack(event.stacktrace)
    return safe
  }

  private static func sanitizeStack(_ stack: SentryStacktrace?) -> SentryStacktrace? {
    guard let stack else { return nil }
    let frames = stack.frames.map { original in
      let frame = Sentry.Frame()
      frame.function = original.function
      frame.module = original.module
      frame.platform = original.platform
      frame.lineNumber = original.lineNumber
      frame.columnNumber = original.columnNumber
      frame.inApp = original.inApp
      frame.instructionAddress = original.instructionAddress
      frame.imageAddress = original.imageAddress
      frame.symbolAddress = original.symbolAddress
      return frame
    }
    let registers = stack.registers.filter {
      $0.value.range(of: "^(0x)?[a-fA-F0-9]+$", options: .regularExpression) != nil
    }
    return SentryStacktrace(frames: frames, registers: registers)
  }
}

private enum HoystInviteLink {
  static let pendingURLDefaultsKey = "HoystPendingCircleInviteURL"

  static func storeIfInvite(_ url: URL) {
    let isWebInvite =
      url.scheme?.lowercased() == "https" &&
      url.host?.lowercased() == "hoyst.app" &&
      url.pathComponents.dropFirst().first?.lowercased() == "join"
    let isCustomSchemeInvite =
      url.scheme?.lowercased() == "hoyst" &&
      (
        url.host?.lowercased() == "join" ||
        url.pathComponents.dropFirst().first?.lowercased() == "join"
      )

    guard isWebInvite || isCustomSchemeInvite else {
      return
    }

    UserDefaults.standard.set(url.absoluteString, forKey: pendingURLDefaultsKey)
  }

  static func storeIfInvite(_ userActivity: NSUserActivity) {
    guard
      userActivity.activityType == NSUserActivityTypeBrowsingWeb,
      let url = userActivity.webpageURL
    else {
      return
    }

    storeIfInvite(url)
  }
}

@main
class AppDelegate: RCTAppDelegate {
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    HoystNativeMonitoring.initialize()
    if let url = launchOptions?[.url] as? URL {
      HoystInviteLink.storeIfInvite(url)
    }

    FirebaseApp.configure()
    self.moduleName = "Hoyst"
    self.dependencyProvider = RCTAppDependencyProvider()

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if url.host?.lowercased() == "firebaseauth" {
      return false
    }

    if Auth.auth().canHandle(url) {
      return true
    }

    HoystInviteLink.storeIfInvite(url)
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    HoystInviteLink.storeIfInvite(userActivity)
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = appDelegate.window.rootViewController
    appDelegate.window = window
    self.window = window
    window.makeKeyAndVisible()

    connectionOptions.urlContexts.forEach { context in
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
    connectionOptions.userActivities.forEach { userActivity in
      _ = appDelegate.application(
        UIApplication.shared,
        continue: userActivity,
        restorationHandler: { _ in }
      )
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    URLContexts.forEach { context in
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
