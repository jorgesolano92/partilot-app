import UIKit
import Capacitor

// Ciclo de vida UIScene: obligatorio al compilar con el SDK de iOS 27
// (sin él la app aborta al arrancar en _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// La ventana y el CAPBridgeViewController los crea el storyboard Main declarado en Info.plist.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Algunos plugins consultan la ventana a través del AppDelegate.
        (UIApplication.shared.delegate as? AppDelegate)?.window = window

        // Enlaces o actividades con los que se abrió la app en frío.
        if let urlContext = connectionOptions.urlContexts.first {
            openURL(urlContext)
        }
        if let activity = connectionOptions.userActivities.first {
            continueActivity(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let urlContext = URLContexts.first {
            openURL(urlContext)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    private func openURL(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        options[.sourceApplication] = context.options.sourceApplication
        options[.annotation] = context.options.annotation
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
    }

    private func continueActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}
