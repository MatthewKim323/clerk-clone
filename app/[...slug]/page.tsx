import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getRoute, type RouteMarkup } from '@/lib/routes';
import { RouteContent } from '@/components/RouteContent';
import {permanentRouteRedirects} from '@/lib/route-aliases';

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<{ only?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = getRoute((await params).slug);
  return { title: route?.title || 'Page not found | Aurora' };
}

export default async function CapturedPage({ params, searchParams }: Props) {
  const {slug}=await params;
  const destination=permanentRouteRedirects['/'+slug.join('/')];
  if(destination)permanentRedirect(destination);
  const route = getRoute(slug);
  if (!route) notFound();
  const { only } = await searchParams;
  const markup=(value:RouteMarkup)=>({...value,bodyHtml:only?value.mainHtml||value.bodyHtml:value.bodyHtml,mainHtml:undefined});
  const content={...route,...markup(route),variants:route.variants?Object.fromEntries(Object.entries(route.variants).map(([name,value])=>[name,markup(value)])):undefined};
  return <>
    <link rel="stylesheet" href={route.cssPath} />
    <RouteContent route={content} />
  </>;
}
