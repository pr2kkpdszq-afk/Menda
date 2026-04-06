import { useState } from "react";

export default function ProviderSignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/providers/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          businessName,
          serviceType,
          description,
          contactEmail,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to create provider profile");
      }

      const provider = await response.json();
      window.location.href = "/provider/dashboard";
      return provider;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main>
      <h1>Provider Signup</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Business Name
          <input
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            required
          />
        </label>

        <label>
          Service Type
          <input
            type="text"
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>

        <label>
          Contact Email
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            required
          />
        </label>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing up..." : "Sign up as provider"}
        </button>
      </form>
    </main>
  );
}
