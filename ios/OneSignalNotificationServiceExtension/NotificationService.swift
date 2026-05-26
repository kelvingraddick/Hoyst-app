import UserNotifications
import OneSignalExtension

class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var receivedRequest: UNNotificationRequest!
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    receivedRequest = request
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    if let bestAttemptContent = bestAttemptContent {
      OneSignalExtension.didReceiveNotificationExtensionRequest(
        receivedRequest,
        with: bestAttemptContent,
        withContentHandler: contentHandler
      )
    }
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler,
      let bestAttemptContent = bestAttemptContent
    {
      OneSignalExtension.serviceExtensionTimeWillExpireRequest(
        receivedRequest,
        with: bestAttemptContent
      )
      contentHandler(bestAttemptContent)
    }
  }
}
