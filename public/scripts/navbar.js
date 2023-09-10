document.addEventListener("DOMContentLoaded", () => {
    // Mobile Nav Menu Open/Close Logic
    let closeBtn = document.querySelector("#menu-icon-close");
    let openBtn = document.querySelector("#menu-icon-hamburger");
    let mobileMenu = document.querySelector("#mobile-nav-menu-open");
    let doc = document.querySelector("html");
    let hero = document.querySelector("#hero");
    let mainNav = document.querySelector("#navbar");

    openBtn.addEventListener("click", () => {
        mobileMenu.classList.remove("hidden");
        doc.classList.add("disable-scroll");
    });
    
    closeBtn.addEventListener("click", () => {
        mobileMenu.classList.add("hidden");
        doc.classList.remove("disable-scroll");
    });

    let observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        mainNav.classList.toggle("transparent-nav", entry.isIntersecting);
      });
      },{ threshold: .15 });

    observer.observe(hero);
});