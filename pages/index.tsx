import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    // Temporary demo login.
    // This will later be replaced by Pair B's real API.
    const validCredentials =
      (email === "field@bhunetra.demo" &&
        password === "field123") ||
      (email === "dgm@bhunetra.demo" &&
        password === "dgm123");

    if (!validCredentials) {
      setError(
        "Incorrect email or password. Please use the demo credentials."
      );
      setLoading(false);
      return;
    }

    // Temporary demo token.
    // The real backend will provide this later.
    localStorage.setItem(
      "bhunetra_token",
      "demo-token"
    );

    const role =
      email === "dgm@bhunetra.demo"
        ? "DGM Admin"
        : "Field Officer";

    const name =
      email === "dgm@bhunetra.demo"
        ? "DGM Admin"
        : "Field Officer";

    localStorage.setItem("bhunetra_role", role);
    localStorage.setItem("bhunetra_name", name);

    await router.push("/dashboard");

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-xl">

        <h1 className="text-3xl font-bold text-white">
          BhuNetra
        </h1>

        <p className="mt-2 mb-8 text-gray-400">
          AI-Driven Mining Surveillance System
        </p>

        <div className="mb-4">
          <label
            htmlFor="email"
            className="mb-2 block text-sm text-gray-300"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="field@bhunetra.demo"
            className="w-full rounded-md border border-gray-600 bg-gray-700 p-3 text-white outline-none"
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="password"
            className="mb-2 block text-sm text-gray-300"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="••••••••"
            className="w-full rounded-md border border-gray-600 bg-gray-700 p-3 text-white outline-none"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-md bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-6 rounded-md bg-gray-700 p-4 text-xs text-gray-300">
          <p className="mb-2 font-semibold">
            Demo credentials
          </p>

          <p>
            Field Officer:
            <br />
            field@bhunetra.demo / field123
          </p>

          <p className="mt-2">
            DGM Admin:
            <br />
            dgm@bhunetra.demo / dgm123
          </p>
        </div>

      </div>
    </div>
  );
}