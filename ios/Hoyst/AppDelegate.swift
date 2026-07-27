import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import FirebaseAuth

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

  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    connectionOptions.urlContexts.forEach { context in
      HoystInviteLink.storeIfInvite(context.url)
    }
    connectionOptions.userActivities.forEach { userActivity in
      HoystInviteLink.storeIfInvite(userActivity)
    }
  }

  override func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
    URLContexts.forEach { context in
      HoystInviteLink.storeIfInvite(context.url)
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        open: context.url,
        options: [:]
      )
    }
  }

  override func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    HoystInviteLink.storeIfInvite(userActivity)
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
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
