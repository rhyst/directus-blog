import { defineHook } from "@directus/extensions-sdk";

const log = (text: string, object?: any, emoji: string = "📜") => {
  const upperText =
    text?.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : "";
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(-2)} ${emoji} ${upperText}`
  );
  if (object) {
    console.log(object);
  }
};

export default defineHook((hooks) => {
  if (!global.hooks) {
	log(`Starting Directus Blog extension hooks helper`, null, "🚀");
    global.hooks = hooks;
  } else {
	log(`Directus Blog extension hooks helper already set up`, null, "🚀");
  }
});
