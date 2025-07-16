// src/routes/admin/common-codes/+page.js
import { redirect } from '@sveltejs/kit';

export async function load({ parent, fetch }) {
  const { user } = await parent();
  
  if (!user) {
    throw redirect(302, '/');
  }
  
  if (user.role !== 'admin') {
    throw redirect(302, '/admin');
  }
  
  return {
    user
  };
}