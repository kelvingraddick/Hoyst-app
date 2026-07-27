#import <React/RCTBridgeModule.h>

static NSString *const HoystPendingCircleInviteURLKey =
    @"HoystPendingCircleInviteURL";

@interface HoystInviteLinkModule : NSObject <RCTBridgeModule>
@end

@implementation HoystInviteLinkModule

RCT_EXPORT_MODULE(HoystInviteLink)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(takePendingURL,
                 takePendingURLWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  NSString *pendingURL = [defaults stringForKey:HoystPendingCircleInviteURLKey];

  if (pendingURL != nil) {
    [defaults removeObjectForKey:HoystPendingCircleInviteURLKey];
  }

  resolve(pendingURL ?: [NSNull null]);
}

@end
