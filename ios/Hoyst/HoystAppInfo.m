#import <React/RCTBridgeModule.h>
@interface HoystAppInfo : NSObject <RCTBridgeModule>
@end
@implementation HoystAppInfo
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }
- (NSDictionary *)constantsToExport {
  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  return @{ @"version": info[@"CFBundleShortVersionString"] ?: @"", @"build": info[@"CFBundleVersion"] ?: @"" };
}
@end
