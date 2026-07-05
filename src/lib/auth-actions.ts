"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

function rethrowIfRedirect(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "NEXT_REDIRECT" ||
      (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
  ) {
    throw error;
  }
}

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/dashboard" });
  } catch (error) {
    rethrowIfRedirect(error);
    redirect("/login?error=google");
  }
}

export async function signInWithDev(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    rethrowIfRedirect(error);
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    redirect("/login?error=dev");
  }
}

export async function signInWithResend(formData: FormData) {
  try {
    await signIn("resend", {
      email: formData.get("email") as string,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    rethrowIfRedirect(error);
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    redirect("/login?error=email");
  }
}

export async function signOutAction() {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/" });
}
