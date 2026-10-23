const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function accountEmail({ to, url, kind, origin }) {
  const link = new URL(url);
  if (
    link.origin !== origin ||
    !["/api/auth/verify-email", "/reset-password"].includes(link.pathname)
  )
    throw Error("Invalid account email link");
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to) || to.length > 254)
    throw Error("Invalid account email destination");
  const verify = kind === "verify",
    action = verify ? "Verify your email" : "Reset your password";
  const context = verify
    ? "Confirm this email address for your Sponsor Intel account."
    : "A password reset was requested for your Sponsor Intel account.";
  const expiry = verify
    ? "This link expires in one hour."
    : "This link expires in 30 minutes. Using it will sign out other sessions.";
  return {
    from: { email: "accounts@sponsorintel.london", name: "Sponsor Intel" },
    to,
    subject: action + " — Sponsor Intel",
    text: `${context}\n\n${action}: ${url}\n\n${expiry}\nIf you did not request this, ignore this email. Your password is not changed by receiving this message.\n\nSponsor Intel · https://sponsorintel.london`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#183d32"><h1>${action}</h1><p>${context}</p><p><a href="${escape(url)}" style="display:inline-block;background:#234f38;color:white;padding:14px 20px;border-radius:8px">${action}</a></p><p>${expiry}</p><p>If you did not request this, ignore this email. Your password is not changed by receiving this message.</p><hr><p>Sponsor Intel · <a href="https://sponsorintel.london">sponsorintel.london</a></p></div>`,
  };
}
export async function sendAccountEmail(env, input) {
  if (!env.EMAIL || env.EMAIL_VERIFICATION_ENABLED !== "true")
    throw Error("Account email is unavailable");
  try {
    await env.EMAIL.send(accountEmail(input));
  } catch {
    console.error(
      JSON.stringify({ event: "account_email_failed", kind: input.kind }),
    );
    throw Error("Account email could not be sent. Please try again later.");
  }
}
