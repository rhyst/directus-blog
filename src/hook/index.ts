import { defineHook } from "@directus/extensions-sdk";

type Hook = ReturnType<typeof defineHook>;

const log = (text: string) => {
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(
      -2
    )} 📜 ${text[0].toUpperCase()}${text.slice(1)}`
  );
};

const hook: Hook = () => {
  log("setting up hooks");
  return {
    "items.create": (...args) => global.hooks?.["items.create"]?.(...args),
    "items.update": (...args) => global.hooks?.["items.update"]?.(...args),
  };
};

export default hook;
