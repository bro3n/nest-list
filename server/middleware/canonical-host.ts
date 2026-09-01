// Redirect the default production Pages domain to the custom domain. Preview
// deployments (<hash>.nest-list.pages.dev) are left untouched so previews work.
export default defineEventHandler((event) => {
  if (getRequestHost(event) === "nest-list.pages.dev") {
    const url = getRequestURL(event);
    return sendRedirect(event, `https://nestlist.org${url.pathname}${url.search}`, 301);
  }
});
