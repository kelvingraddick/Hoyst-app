import Foundation
import React
import UIKit

@objc(HoystClipboardImage)
class HoystClipboardImage: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(copyImage:resolver:rejecter:)
  func copyImage(
    _ uri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: uri) else {
      reject("invalid_uri", "The story image URI is invalid.", nil)
      return
    }

    do {
      let data = try Data(contentsOf: url)
      DispatchQueue.main.async {
        UIPasteboard.general.setData(data, forPasteboardType: "public.png")
        resolve(true)
      }
    } catch {
      reject("copy_failed", "The story image could not be copied.", error)
    }
  }
}
