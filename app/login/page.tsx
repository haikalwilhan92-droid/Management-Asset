import { signIn } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <form action={signIn} className="card space-y-3">
        <h1 className="text-lg font-semibold">Log in</h1>
        {error && (
          <p className="text-sm text-red-600">
            {error === "unconfirmed"
              ? "This email is not confirmed yet. In Supabase → Authentication → Users, confirm the user (or re-create it with “Auto Confirm User” ticked)."
              : "Wrong email or password."}
          </p>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn w-full">Log in</button>
      </form>
    </div>
  );
}
