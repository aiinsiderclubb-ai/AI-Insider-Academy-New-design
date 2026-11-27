"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Marks every notification read once the list has been seen, then lets the bell's dot go out. */
export function MarkNotificationsRead() {
  const router = useRouter();
  React.useEffect(() => {
    fetch("/api/me/notifications/read-all", { method: "PATCH" })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
