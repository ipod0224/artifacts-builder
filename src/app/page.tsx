import { redirect } from 'next/navigation';

export default async function Page() {
  // 直接跳轉到 RAG 頁面，繞過認證
  redirect('/dashboard/rag');
}
