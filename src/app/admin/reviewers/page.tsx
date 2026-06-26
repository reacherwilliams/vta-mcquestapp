import { redirect } from "next/navigation"

// Reviewer management has moved into the Reviewers tab of the SA-only
// Platform Team page. This route stays as a redirect so bookmarks don't 404.
export default function ReviewersRedirect() {
  redirect("/admin/platform-team?tab=reviewers")
}
