import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Local state seeded from server-rendered data. It can be edited locally
 * (optimistic updates) and resets whenever the server sends a newer value.
 */
export function useServerState<T>(
  serverValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);

  if (seen !== serverValue) {
    setSeen(serverValue);
    setValue(serverValue);
  }

  return [value, setValue];
}
