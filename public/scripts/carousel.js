document.addEventListener("DOMContentLoaded", () => {
  let wrapper = document.querySelector("#browser-permissions-img-wrapper");
  let img1 = document.querySelector("#browser-permissions-img-chrome");
  let img2 = document.querySelector("#browser-permissions-img-firefox");

  let lbls = document.querySelectorAll(".carousel-label");
  let lbl1 = lbls[0];
  let lbl2 = lbls[1];

  let interval = setInterval(() => {
    img1.classList.toggle("invisible");
    img2.classList.toggle("invisible");
    lbl1.classList.toggle("invisible");
    lbl2.classList.toggle("invisible");
  }, 4000);

  wrapper.addEventListener("mouseover", (e) => {
    if (e.target.tagName === "IMG") {
      clearInterval(interval);
    }
  });

  wrapper.addEventListener("mouseout", (e) => {
    if (e.target.tagName === "IMG") {
      interval = setInterval(() => {
        img1.classList.toggle("invisible");
        img2.classList.toggle("invisible");
        lbl1.classList.toggle("invisible");
        lbl2.classList.toggle("invisible");
      }, 4000);
    }
  });
});
