import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  path?: string;
  noindex?: boolean;
}

/**
 * Per-route head tags. Internal app pages pass noindex so they stay
 * out of search engines while the public landing/login remain indexable.
 */
export function SEO({ title, description, path, noindex }: SEOProps) {
  const fullTitle = `${title} | DBH Inventory`;
  const url = path ? `https://dbhabaya.lovable.app${path}` : undefined;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {url && <link rel="canonical" href={url} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
}
