#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HoystClipboardImage, NSObject)

RCT_EXTERN_METHOD(copyImage:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
