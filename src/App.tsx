import { lazy, Suspense, useEffect } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { DashboardApp } from "./dashboard/DashboardApp";
import { ExplorePage } from "./explore/ExplorePage";
import { LandingPage } from "./landing/LandingPage";
import { ForgotPasswordPage } from "./onboarding/ForgotPasswordPage";
import { LoginPage } from "./onboarding/LoginPage";
import OAuthCallbackPage from "./onboarding/OAuthCallbackPage";
import { OnboardingPage } from "./onboarding/OnboardingPage";
import { ConnectPage } from "./pages/ConnectPage";
import { DocsPage } from "./pages/DocsPage";
import { InvitePage } from "./pages/InvitePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { StatusPage } from "./pages/StatusPage";
import { TermsPage } from "./pages/TermsPage";
import { PortfolioView } from "./portfolio/PortfolioView";

const LogoStudioPage = lazy(() =>
	import("./logo-studio/LogoStudioPage").then((m) => ({
		default: m.LogoStudioPage,
	})),
);
const ImageToolsPage = lazy(() =>
	import("./image-tools/ImageToolsPage").then((m) => ({
		default: m.ImageToolsPage,
	})),
);
// Dev-only: mobile primitives showcase (only bundled in dev mode)
const UiShowcase = import.meta.env.DEV
	? lazy(() =>
			import("./dev/UiShowcase").then((m) => ({ default: m.UiShowcase })),
		)
	: null;

import { useThemeStore } from "@/stores/theme-store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuthStore } from "./stores/auth-store";

/** Scroll to #hash on navigation (React Router doesn't do this for SPAs) */
function HashScroller() {
	const { hash, pathname } = useLocation();
	useEffect(() => {
		if (!hash) return;
		// Small delay to let the page render before scrolling
		const timer = setTimeout(() => {
			const el = document.getElementById(hash.slice(1));
			if (el) el.scrollIntoView({ behavior: "smooth" });
		}, 100);
		return () => clearTimeout(timer);
	}, [hash, pathname]);
	return null;
}

function App() {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const onboardingCompleted = useAuthStore((s) => s.onboarding.completed);
	const applyTheme = useThemeStore((s) => s.applyTheme);

	useEffect(() => {
		applyTheme();
	}, [applyTheme]);

	return (
		<BrowserRouter
			// 2026-04-06 — FIX for stale useLocation bug:
			// BrowserRouter v7 wraps location updates in React.startTransition by
			// default, which gets canceled by frequent high-priority re-renders
			// from Zustand stores in DashboardApp. The result was useLocation()
			// returning a stale path while window.location was correct, so
			// sidebar clicks updated the URL bar but never re-rendered the page.
			// See debug session 2026-04-06 for full reproduction.
			unstable_useTransitions={false}
		>
			<HashScroller />
			{/* Skip to main content — accessibility for keyboard users */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#8B5CF6] focus:text-[#05050A] focus:font-semibold focus:text-sm focus:shadow-lg"
			>
				Skip to main content
			</a>
			<ErrorBoundary>
				<div className="min-h-screen bg-[#05050A] text-[#F4F6FF] overflow-x-hidden">
					<Routes>
						{/* Auth-aware public routes — redirect to dashboard if already signed in */}
						<Route
							path="/"
							element={
								isAuthenticated ? (
									<Navigate to="/dashboard" replace />
								) : (
									<LandingPage />
								)
							}
						/>
						<Route path="/explore" element={<ExplorePage />} />
						<Route
							path="/login"
							element={
								isAuthenticated ? (
									<Navigate to="/dashboard" replace />
								) : (
									<LoginPage />
								)
							}
						/>
						<Route path="/forgot-password" element={<ForgotPasswordPage />} />
						<Route path="/portfolio/:username" element={<PortfolioView />} />
						<Route path="/privacy" element={<PrivacyPage />} />
						<Route path="/terms" element={<TermsPage />} />
						<Route path="/status" element={<StatusPage />} />
						<Route path="/docs" element={<DocsPage />} />
						<Route path="/connect/:token" element={<ConnectPage />} />
						<Route path="/invite" element={<InvitePage />} />
						<Route
							path="/logo-studio"
							element={
								<Suspense
									fallback={
										<div className="flex items-center justify-center min-h-screen">
											<div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
										</div>
									}
								>
									<LogoStudioPage />
								</Suspense>
							}
						/>
						<Route
							path="/image-tools"
							element={
								<Suspense
									fallback={
										<div className="flex items-center justify-center min-h-screen">
											<div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
										</div>
									}
								>
									<ImageToolsPage />
								</Suspense>
							}
						/>
						<Route path="/oauth/callback" element={<OAuthCallbackPage />} />

						{/* Onboarding — only show if logged in but not completed */}
						<Route
							path="/onboarding"
							element={
								isAuthenticated && !onboardingCompleted ? (
									<OnboardingPage />
								) : (
									<Navigate
										to={isAuthenticated ? "/dashboard" : "/login"}
										replace
									/>
								)
							}
						/>

						{/* Dashboard — protected */}
						<Route
							path="/dashboard/*"
							element={
								isAuthenticated ? (
									onboardingCompleted ? (
										<DashboardApp />
									) : (
										<Navigate to="/onboarding" replace />
									)
								) : (
									<Navigate to="/login" replace />
								)
							}
						/>

						{/* Dev-only: UI primitives showcase (Phase 0 + Aurora) */}
						{import.meta.env.DEV && UiShowcase && (
							<Route
								path="/dev/ui"
								element={
									<Suspense
										fallback={
											<div className="flex items-center justify-center min-h-screen">
												<div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
											</div>
										}
									>
										<UiShowcase />
									</Suspense>
								}
							/>
						)}

						
						{/* Alias: /dev/ui-agentin also loads the Aurora showcase */}
						{import.meta.env.DEV && UiShowcase && (
							<Route
								path="/dev/ui-agentin"
								element={
									<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
										<UiShowcase />
									</Suspense>
								}
							/>
						)}

						{/* Fallback */}
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</div>
			</ErrorBoundary>
			<Toaster
				position="bottom-right"
				toastOptions={{
					style: {
						background: "#0C0C18",
						border: "1px solid rgba(139,92,246,0.2)",
						color: "#F4F6FF",
					},
				}}
			/>
		</BrowserRouter>
	);
}

export default App;
