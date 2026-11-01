#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

static NSDictionary *HoystRect(CGRect rect) {
  return @{@"x": @(rect.origin.x), @"y": @(rect.origin.y),
           @"width": @(rect.size.width), @"height": @(rect.size.height)};
}

@interface HoystNavigationLayoutView : UIView
@property (nonatomic, copy) RCTDirectEventBlock onGeometryChange;
@property (nonatomic, copy) NSDictionary *lastGeometry;
- (void)reportGeometry;
@end

@implementation HoystNavigationLayoutView
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.userInteractionEnabled = NO;
    if (@available(iOS 27.1, *)) {
      NSArray<UITrait> *traits = [UITraitCollection.systemTraitsAffectingVerticalBarEdge arrayByAddingObject:UITraitLayoutDirection.class];
      [self registerForTraitChanges:traits
                       withHandler:^(HoystNavigationLayoutView *view, UITraitCollection *previous) {
        [view reportGeometry];
      }];
    }
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(reportGeometry)
      name:UIApplicationDidBecomeActiveNotification object:nil];
  }
  return self;
}
- (void)dealloc { [[NSNotificationCenter defaultCenter] removeObserver:self]; }
- (void)didMoveToWindow { [super didMoveToWindow]; [self reportGeometry]; }
- (void)safeAreaInsetsDidChange { [super safeAreaInsetsDidChange]; [self reportGeometry]; }
- (void)layoutSubviews { [super layoutSubviews]; [self reportGeometry]; }
- (void)setOnGeometryChange:(RCTDirectEventBlock)callback {
  _onGeometryChange = [callback copy];
  self.lastGeometry = nil;
  [self reportGeometry];
}
- (void)reportGeometry {
  if (!self.window || !self.onGeometryChange || CGRectIsEmpty(self.bounds)) return;
  NSString *edge = @"unspecified";
  if (@available(iOS 27.1, *)) {
    switch (self.traitCollection.verticalBarEdge) {
      case UIVerticalBarEdgeLeading: edge = @"leading"; break;
      case UIVerticalBarEdgeTrailing: edge = @"trailing"; break;
      default: break;
    }
  }
  UIWindowScene *scene = self.window.windowScene;
  CGRect status = scene.statusBarManager.statusBarFrame;
  if (!CGRectIsEmpty(status)) {
    id<UICoordinateSpace> coordinateSpace;
    if (@available(iOS 26.0, *)) {
      coordinateSpace = scene.effectiveGeometry.coordinateSpace;
    } else {
      coordinateSpace = scene.coordinateSpace;
    }
    status = [self.window convertRect:status fromCoordinateSpace:coordinateSpace];
    status = [self convertRect:status fromView:self.window];
    status = CGRectIntersection(self.bounds, status);
    if (CGRectIsNull(status)) status = CGRectZero;
  }
  UIEdgeInsets safe = self.safeAreaInsets;
  NSDictionary *geometry = @{
    @"edge": edge,
    @"rtl": self.effectiveUserInterfaceLayoutDirection == UIUserInterfaceLayoutDirectionRightToLeft ? @YES : @NO,
    @"bounds": HoystRect(self.bounds), @"statusArea": HoystRect(status),
    @"insets": @{@"top": @(safe.top), @"bottom": @(safe.bottom), @"left": @(safe.left), @"right": @(safe.right)}
  };
  if (![geometry isEqual:self.lastGeometry]) {
    self.lastGeometry = geometry;
    self.onGeometryChange(geometry);
  }
}
@end

@interface HoystNavigationLayoutViewManager : RCTViewManager
@end
@implementation HoystNavigationLayoutViewManager
RCT_EXPORT_MODULE(HoystNavigationLayoutView)
RCT_EXPORT_VIEW_PROPERTY(onGeometryChange, RCTDirectEventBlock)
- (UIView *)view { return [HoystNavigationLayoutView new]; }
@end
