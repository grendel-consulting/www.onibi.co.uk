import React from "react"
import useSiteMetadata from "../hooks/use-site-metadata"

type SeoProps = {
    title?: string;
    description?: string;
    pathname?: string;
    children?: React.ReactNode;
};
const SEO = ({ title, description, pathname, children }: SeoProps) => {
  const { title: defaultTitle, description: defaultDescription, siteUrl } = useSiteMetadata()

  const seo = {
    title: title || defaultTitle,
    description: description || defaultDescription,
    url: `${siteUrl}${pathname || ``}`,
  }

  return (
    <>
      <html lang="en-GB" />
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {children}
    </>
  )
}

export default SEO;