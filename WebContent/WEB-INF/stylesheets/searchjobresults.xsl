<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutview" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
	<xsl:param name="webserviceurl" select="'#'"/>
    <xsl:param name="backendRequestUrl" select="'#'"/>
	<xsl:param name="urlparamquery" select="'#'"/>
    <xsl:param name="query" select="'#'"/>
	
	<xsl:param name="pos_name" select="'#'"/>
	<xsl:param name="lemma_name" select="'#'"/>
	<xsl:param name="title_name" select="'#'"/>
	<xsl:param name="author_name" select="'#'"/>
	<xsl:param name="date_name" select="'#'"/>
	<xsl:param name="source_name" select="'#'"/>
	
	<xsl:template match="error">
		<h1>Error</h1>
        <xsl:value-of select="message" />
	</xsl:template>
	
    <xsl:template match="" />
    
	<xsl:template match="summary">
		<div class="pull-right">
			<small>Query: <xsl:value-of select="$query" /></small>
		</div>
	</xsl:template>
	
	<xsl:template match="blacklab-response">
		<div class="span12 contentbox" id="results">
			<div id='waitDisplay' class="alert alert-info">
  				Searching, please wait...
  				<p class="text-center"><i class="icon-spinner icon-spin xxlarge"></i></p>
			</div>
			<script type="text/javascript">
                var backendRequestUrl = '<xsl:value-of select="$backendRequestUrl" />';
				doResults(backendRequestUrl);
			</script>
		</div>
	</xsl:template>
	
</xsl:stylesheet>