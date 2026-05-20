import React, { useMemo, useState } from "react";
import BrandLogo from "./BrandLogo";
import type { AppSession } from "./productTypes";

type AuthPageProps = {
  initialMode?: "login" | "signup";
  onBack: () => void;
  onAuthenticated: (session: AppSession) => void;
};

type AuthMode = "login" | "signup";

function readUsers(): Array<AppSession & { password: string }> {
  try {
    const raw = localStorage.getItem("orixUsers");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: Array<AppSession & { password: string }>) {
  localStorage.setItem("orixUsers", JSON.stringify(users));
}

export default function AuthPage({
  initialMode = "signup",
  onBack,
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(
    () => (mode === "signup" ? "Create your ORIX workspace" : "Welcome back to ORIX"),
    [mode]
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Enter your email and password.");
      return;
    }

    const users = readUsers();

    if (mode === "signup") {
      if (!cleanName) {
        setError("Enter your display name.");
        return;
      }

      if (cleanPassword.length < 4) {
        setError("Use at least 4 characters for the demo password.");
        return;
      }

      if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
        setError("This email is already registered.");
        return;
      }

      const session: AppSession = {
        id: `user-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
      };

      writeUsers([...users, { ...session, password: cleanPassword }]);
      localStorage.setItem("orixSession", JSON.stringify(session));
      onAuthenticated(session);
      return;
    }

    const found = users.find(
      (user) => user.email.toLowerCase() === cleanEmail && user.password === cleanPassword
    );

    if (!found) {
      setError("Wrong email or password.");
      return;
    }

    const session: AppSession = {
      id: found.id,
      name: found.name,
      email: found.email,
    };

    localStorage.setItem("orixSession", JSON.stringify(session));
    onAuthenticated(session);
  }

  return (
    <div className="authShell">
      <button className="authBackLink" type="button" onClick={onBack}>
        ← Back to site
      </button>

      <div className="authGlow authGlowA" />
      <div className="authGlow authGlowB" />

      <section className="authCard glassAuthCard">
        <BrandLogo />
        <div className="authTabs">
          <button
            className={mode === "signup" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign up
          </button>
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Log in
          </button>
        </div>

        <h1>{title}</h1>
        <p>
          {mode === "signup"
            ? "Create a workspace to access your project library and start building editor scenes."
            : "Continue to your saved projects and reopen any ORIX canvas."}
        </p>

        <form className="authForm" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kyrylo"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <div className="authError">{error}</div>}

          <button className="marketingPrimaryBtn authSubmit" type="submit">
            {mode === "signup" ? "Create workspace" : "Open projects"}
          </button>
        </form>

        <div className="authNote">
          Demo authentication is stored locally in the browser for this frontend stage.
        </div>
      </section>

      <aside className="authPreview glassSoftPanel">
        <span className="sectionBadge">After login</span>
        <h2>Projects become the entry point.</h2>
        <p>
          Create a project, add a description, reopen the editor and continue work later.
        </p>
        <div className="authPreviewCards">
          <article><strong>Landing page</strong><span>Updated today</span></article>
          <article><strong>Component library</strong><span>3 scenes</span></article>
          <article><strong>Mobile app pitch</strong><span>Ready to open</span></article>
        </div>
      </aside>
    </div>
  );
}
