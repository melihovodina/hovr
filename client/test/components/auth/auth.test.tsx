import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { nav } from "@/test/navigation";
import { CheckEmail } from "@/components/auth/check-email";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

const signedOut = () => json(401, { error: "Sign in to continue." });

beforeEach(() => nav.reset());
afterEach(() => vi.unstubAllGlobals());

async function fillSignIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  test.each([
    ["confirmed=1", "Your email is confirmed. Sign in to get started."],
    ["error=link_expired", "That link has expired or was already used. Sign in, or ask for a new one."],
    ["error=link_invalid", "That link didn’t work. Sign in, or ask for a new one."],
  ])("shows the email link result for ?%s", async (query, text) => {
    nav.search = new URLSearchParams(query);
    mockFetch(signedOut());
    render(<SignInForm />);
    expect(await screen.findByText(text)).toBeTruthy();
  });

  test("sends someone already signed in to the app", async () => {
    mockFetch(json(200, { id: "u1", email: "anna@example.com", plan: "free" }));
    render(<SignInForm />);
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/app"));
  });

  test("signs in and goes to the app", async () => {
    const fetch = mockFetch(signedOut(), json(200, { user: { id: "u1", email: "anna@example.com" } }));
    render(<SignInForm />);
    await fillSignIn("anna@example.com", "correct-horse-1");

    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/app"));
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe("/api/auth/signin");
    expect(JSON.parse(init?.body as string)).toEqual({ email: "anna@example.com", password: "correct-horse-1" });
  });

  test("shows the server's message for a wrong password", async () => {
    mockFetch(signedOut(), json(401, { error: "Wrong email or password." }));
    render(<SignInForm />);
    await fillSignIn("anna@example.com", "nope-nope");

    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  test("an unconfirmed email switches to the check-your-inbox screen", async () => {
    mockFetch(signedOut(), json(403, { error: "Confirm your email first. We sent you a link." }));
    render(<SignInForm />);
    await fillSignIn("new@example.com", "long-enough-1");

    expect(await screen.findByText("Confirm your email first")).toBeTruthy();
    expect(screen.getByText("new@example.com")).toBeTruthy();
  });
});

test("SignUpForm shows the check-your-inbox screen, and can go back to change the email", async () => {
  const fetch = mockFetch(signedOut(), json(200, { status: "check_email" }));
  const user = userEvent.setup();
  render(<SignUpForm />);

  await user.type(screen.getByLabelText("Email"), "new@example.com");
  await user.type(screen.getByLabelText("Password"), "long-enough-1");
  await user.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("Check your inbox")).toBeTruthy();
  expect(fetch.mock.calls[1][0]).toBe("/api/auth/signup");

  await user.click(screen.getByRole("button", { name: "Use a different email" }));
  expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("new@example.com");
});

describe("CheckEmail", () => {
  test.each([
    ["signup", "/api/auth/resend"],
    ["unconfirmed", "/api/auth/resend"],
    ["recover", "/api/auth/recover"],
  ] as const)("“Send it again” after %s calls %s", async (kind, url) => {
    const fetch = mockFetch(json(200, { status: "check_email" }));
    render(<CheckEmail email="anna@example.com" kind={kind} onBack={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Send it again" }));

    expect(await screen.findByText("Sent. Use the link in the newest email.")).toBeTruthy();
    expect(fetch.mock.calls[0][0]).toBe(url);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ email: "anna@example.com" });
  });

  test("shows a rate limit from the server", async () => {
    mockFetch(json(429, { error: "Too many attempts. Wait a minute and try again." }));
    render(<CheckEmail email="anna@example.com" kind="signup" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Send it again" }));
    expect(await screen.findByText("Too many attempts. Wait a minute and try again.")).toBeTruthy();
  });
});

describe("ResetPasswordForm", () => {
  async function submit(password: string) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), password);
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
  }

  test("saves the new password and goes to the app", async () => {
    mockFetch(new Response(null, { status: 204 }));
    render(<ResetPasswordForm />);
    await submit("new-password-1");
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/app"));
  });

  test("without a session the link has run out", async () => {
    mockFetch(json(401, { error: "Sign in to continue." }));
    render(<ResetPasswordForm />);
    await submit("new-password-1");
    expect(await screen.findByText("This link has run out")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Send me a new link" }).getAttribute("href")).toBe("/forgot-password");
  });
});
