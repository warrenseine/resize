
//
//  ActionViewController.swift
//  ActionExt
//
//  Created by xk on 2019/07/11.
//  Copyright © 2019 Facebook. All rights reserved.
//
import UIKit
import MobileCoreServices

class ActionViewController: UIViewController {
//    override func viewDidLoad() {
//        super.viewDidLoad()
//
//        // Get the item[s] we're handling from the extension context.
//
//        // For example, look for an image and place it into an image view.
//        // Replace this with something appropriate for the type[s] your extension supports.
//        var imageFound = false
//        for item in self.extensionContext!.inputItems as! [NSExtensionItem] {
//            for provider in item.attachments! as! [NSItemProvider] {
//                if provider.hasItemConformingToTypeIdentifier(kUTTypeImage as String) {
//                    // This is an image. We'll load it, then place it in our image view.
//                    weak var weakImageView = self.imageView
//                    provider.loadItem(forTypeIdentifier: kUTTypeImage as String, options: nil, completionHandler: { (imageURL, error) in
//                        OperationQueue.main.addOperation {
//                            if let strongImageView = weakImageView {
//                                if let imageURL = imageURL as? URL {
//                                    strongImageView.image = UIImage(data: try! Data(contentsOf: imageURL))
//                                }
//                            }
//                        }
//                    })
//
//                    imageFound = true
//                    break
//                }
//            }
//
//            if (imageFound) {
//                // We only handle one image, so stop looking for more.
//                break
//            }
//        }
//    }
  
  override func loadView() {
    let jsCodeLocation: URL
    let rootView: RCTRootView
    
    jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "extension", fallbackResource: nil)
    
    rootView = RCTRootView(bundleURL: jsCodeLocation, moduleName: "ResizeExtension", initialProperties: nil, launchOptions: nil)
    self.view = rootView;

    ActionExtension.viewController = self;
  }

//    @IBAction func done() {
//        // Return any edited content to the host app.
//        // This template doesn't do anything, so we just echo the passed in items.
//        self.extensionContext!.completeRequest(returningItems: self.extensionContext!.inputItems, completionHandler: nil)
//    }
}