import { ShieldCheck } from "lucide-react";
import * as apiClient from "../api-client";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { siteConfig } from "../config/siteConfig";

const SignIn = () => {
  return (
    <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8">
        <Card className="relative overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-100 rounded-full opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary-200 rounded-full opacity-30" />

          <CardHeader className="text-center relative z-10 pb-6">
            <img
              src={siteConfig.brand.logoPath}
              alt={siteConfig.brand.fullName}
              className="mx-auto h-16 w-auto object-contain rounded-md bg-white px-2 py-1 shadow-soft mb-4"
            />
            <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
              Sign In
            </CardTitle>
            <CardDescription className="text-gray-600">
              Authentication is managed by Microsoft Entra ID.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 mt-0.5" />
                <p>
                  Use your Microsoft work/school account. Email/password and
                  Google sign-in are disabled.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full py-6 px-4 rounded-md border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all duration-200 flex items-center justify-center gap-2"
              onClick={() => {
                const baseUrl = apiClient.getApiBaseUrl();
                window.location.href = `${baseUrl}/api/auth/microsoft`;
              }}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="2" y="2" width="9" height="9" fill="#f25022" />
                <rect x="13" y="2" width="9" height="9" fill="#7fba00" />
                <rect x="2" y="13" width="9" height="9" fill="#00a4ef" />
                <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export type SignInFormData = {
  email: string;
  password: string;
};

export default SignIn;
