import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import IOSInstallHint from "./components/IOSInstallHint.tsx";

const Auth = lazy(() => import("./pages/Auth.tsx"));
const AuthCallback = lazy(() => import("./pages/AuthCallback.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const PublishListing = lazy(() => import("./pages/PublishListing.tsx"));
const ListingDetail = lazy(() => import("./pages/ListingDetail.tsx"));
const ListingsPage = lazy(() => import("./pages/ListingsPage.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Cart = lazy(() => import("./pages/Cart.tsx"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Installer = lazy(() => import("./pages/Installer.tsx"));
const ModerationCase = lazy(() => import("./pages/ModerationCase.tsx"));

const queryClient = new QueryClient();

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profil" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/publier" element={<PublishListing />} />
              <Route path="/annonces" element={<ListingsPage />} />
              <Route path="/annonce/:id" element={<ListingDetail />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/panier" element={<RequireAuth><Cart /></RequireAuth>} />
              <Route path="/commande/confirmation" element={<OrderConfirmation />} />
              <Route path="/installer" element={<Installer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <IOSInstallHint />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
