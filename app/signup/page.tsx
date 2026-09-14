import { SignupForm } from "@/components/AuthForms";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <div className="text-5xl">👨‍👦‍👦</div>
        <h1 className="h1">Create your family</h1>
        <p className="muted text-sm">One parent account. You add the kids afterwards.</p>
      </div>
      <SignupForm />
    </main>
  );
}
