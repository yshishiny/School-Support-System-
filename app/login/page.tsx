import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <div className="text-5xl">📚</div>
        <h1 className="h1">Study Portal</h1>
        <p className="muted text-sm">Check in daily. Level up. Earn rewards.</p>
      </div>
      <LoginForm />
    </main>
  );
}
