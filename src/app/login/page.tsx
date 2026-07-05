import { auth, authProviders } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  signInWithDev,
  signInWithGoogle,
  signInWithResend,
} from "@/lib/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  google: "Google OAuth non configuré (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).",
  email: "Envoi d'email impossible — configurez RESEND_API_KEY.",
  Configuration: "Provider d'authentification mal configuré.",
  CredentialsSignin: "Email invalide ou refusé.",
  dev: "Connexion dev échouée.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Connexion échouée.") : null;

  const hasOAuth = authProviders.google || authProviders.resend;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion AISEO</CardTitle>
          <CardDescription>
            Connectez-vous pour gérer vos solutions et audits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          {authProviders.google && (
            <form action={signInWithGoogle}>
              <Button type="submit" className="w-full" variant="outline">
                Continuer avec Google
              </Button>
            </form>
          )}

          {authProviders.dev && (
            <form action={signInWithDev} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dev-email">
                  {process.env.NODE_ENV === "development"
                    ? "Dev login (local)"
                    : "Connexion par email"}
                </Label>
                <Input
                  id="dev-email"
                  name="email"
                  type="email"
                  required
                  placeholder="vous@entreprise.com"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                Se connecter
              </Button>
            </form>
          )}

          {authProviders.resend && (
            <>
              {hasOAuth && authProviders.dev && (
                <div className="relative text-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">ou magic link</span>
                </div>
              )}
              <form action={signInWithResend} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="vous@entreprise.com"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Envoyer le lien magique
                </Button>
              </form>
            </>
          )}

          {!hasOAuth && authProviders.dev && (
            <p className="text-xs text-muted-foreground">
              Entrez votre email pour vous connecter. Configurez Google OAuth ou
              Resend pour une authentification sécurisée en production.
            </p>
          )}

          {!authProviders.dev && !hasOAuth && (
            <p className="text-sm text-destructive">
              Aucune méthode de connexion configurée. Ajoutez AUTH_GOOGLE_*,
              RESEND_API_KEY ou AUTH_DEV_LOGIN=true sur Vercel.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
