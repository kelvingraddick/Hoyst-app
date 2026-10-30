#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

@interface HoystKeyboardProbe : UIView
@property (nonatomic, copy) void (^onLayout)(void);
@end

@implementation HoystKeyboardProbe
- (void)layoutSubviews
{
  [super layoutSubviews];
  if (self.onLayout) self.onLayout();
}
@end

@interface HoystKeyboardInsetView : UIView
@property (nonatomic, copy) RCTDirectEventBlock onInsetChange;
@property (nonatomic) CGFloat lastInset;
- (void)reportInset;
@end

@implementation HoystKeyboardInsetView
- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _lastInset = -1;
    self.userInteractionEnabled = NO;
    // UIKit resolves the keyboard against this view's own scene, including
    // windows whose origin is not the origin of the physical display.
    UIKeyboardLayoutGuide *guide = self.keyboardLayoutGuide;
    if (@available(iOS 17.0, *)) guide.usesBottomSafeArea = NO;
    HoystKeyboardProbe *probe = [HoystKeyboardProbe new];
    probe.translatesAutoresizingMaskIntoConstraints = NO;
    probe.userInteractionEnabled = NO;
    __weak HoystKeyboardInsetView *weakSelf = self;
    probe.onLayout = ^{ [weakSelf reportInset]; };
    [self addSubview:probe];
    [NSLayoutConstraint activateConstraints:@[
      [probe.topAnchor constraintEqualToAnchor:guide.topAnchor],
      [probe.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
      [probe.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [probe.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
    ]];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self reportInset];
}

- (void)reportInset
{
  if (!self.window || !self.onInsetChange) return;
  CGFloat inset = MIN(CGRectGetHeight(self.bounds), MAX(0, CGRectGetMaxY(self.bounds) - CGRectGetMinY(self.keyboardLayoutGuide.layoutFrame)));
  if (@available(iOS 17.0, *)) {
    // usesBottomSafeArea is disabled above, so an offscreen keyboard is zero.
  } else if (inset <= self.safeAreaInsets.bottom + 0.5) {
    inset = 0;
  }
  if (fabs(inset - self.lastInset) > 0.5) {
    self.lastInset = inset;
    self.onInsetChange(@{@"inset": @(inset)});
  }
}
@end

@interface HoystKeyboardInsetViewManager : RCTViewManager
@end

@implementation HoystKeyboardInsetViewManager
RCT_EXPORT_MODULE(HoystKeyboardInsetView)
RCT_EXPORT_VIEW_PROPERTY(onInsetChange, RCTDirectEventBlock)
- (UIView *)view { return [HoystKeyboardInsetView new]; }
@end
