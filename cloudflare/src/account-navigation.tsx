import React, { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useCareer } from "./career-data";
import { trackPage } from "./metrics";
type Go = (view: string) => void;
export function AccountActions({ go }: { go: Go }) {
  const { user } = useCareer();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    setOwner(false);
    if (!user) return;
    let active = true;
    fetch("/api/admin/session").then((response) => {
      if (!response.ok) throw Error("Owner access unavailable");
    })
      .then(() => {
        if (active) setOwner(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  return (
    <div className="account-actions">
      {owner && (
        <a
          href="/admin"
          onClick={(e) => {
            e.preventDefault();
            go("admin");
          }}
          className="owner-link"
        >
          <ShieldCheck size={15} /> Admin
        </a>
      )}
      {user ? (
        <a
          href="/account"
          onClick={(e) => {
            e.preventDefault();
            go("account");
          }}
        >
          {user.name.split(" ")[0] || "My account"}
        </a>
      ) : (
        <>
          <a
            href="/signin"
            onClick={(e) => {
              e.preventDefault();
              go("signin");
            }}
          >
            Sign in
          </a>
          <a
            className="account-signup"
            href="/signup"
            onClick={(e) => {
              e.preventDefault();
              go("signup");
            }}
          >
            Sign up <ArrowRight size={13} />
          </a>
        </>
      )}
    </div>
  );
}
export function PageTracking({ view }: { view: string }) {
  useEffect(() => {
    trackPage(view === 'discover' ? '/' : '/' + view);
  }, [view]);
  return null;
}
