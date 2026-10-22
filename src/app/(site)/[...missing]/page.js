import { notFound } from 'next/navigation';

// Any URL no other route handles gets the site's 404 page.
export default function Missing() {
  notFound();
}
