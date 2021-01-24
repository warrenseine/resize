import UIKit
import MobileCoreServices

class ActionViewController: UIViewController {
  override func loadView() {
    let jsCodeLocation: URL
    let rootView: RCTRootView

//    #if DEBUG
//    jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "App", fallbackResource: nil)
//    #else
    jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(
         forFallbackResource: "main", fallbackExtension: "jsbundle"
     )
//    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
//    let x = Bundle.main.bundlePath
//    jsCodeLocation = url!
//    #endif

    rootView = RCTRootView(bundleURL: jsCodeLocation, moduleName: "Resize", initialProperties: nil, launchOptions: nil)
    self.view = rootView;

    ActionExtension.viewController = self;
  }
}
