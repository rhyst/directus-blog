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

const hook = (hooks): void => {
  log("setting up hooks");
  global.hooks = hooks;
};

export default hook;
