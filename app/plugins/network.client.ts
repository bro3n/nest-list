// Tracks online/offline so the UI can show when sync is paused.
export default defineNuxtPlugin(() => {
  const online = useState<boolean>("net:online", () =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const update = () => {
    online.value = navigator.onLine;
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
});
