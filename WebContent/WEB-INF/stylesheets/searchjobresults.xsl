<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	<xsl:param name="urlparamwithoutstart" select="'#'"/>
	<xsl:param name="urlparamwithoutview" select="'#'"/>
	<xsl:param name="urlparamwithoutsort" select="'#'"/>
	<xsl:param name="webserviceurl" select="'#'"/>
	<xsl:param name="urlparamquery" select="'#'"/>
	
	<xsl:param name="pos_name" select="'#'"/>
	<xsl:param name="lemma_name" select="'#'"/>
	<xsl:param name="title_name" select="'#'"/>
	<xsl:param name="author_name" select="'#'"/>
	<xsl:param name="date_name" select="'#'"/>
	<xsl:param name="source_name" select="'#'"/>
	
	<xsl:template match="error">
		<h1>Error</h1>
		<xsl:value-of select="." />
	</xsl:template>
	
	<xsl:template match="SearchSummary">
		<div class="pull-right">
			<small>Query: <xsl:value-of select="Query" /></small>
		</div>
	</xsl:template>
	
	<xsl:template match="JobId">
		<div class="span12 contentbox" id="results">			
			<div class="alert alert-info">
  				Job <xsl:value-of select="." /> in progress: <strong id="status">SEARCHING...</strong>
  				<p class="text-center"><i class="icon-spinner icon-spin xxlarge"></i></p> 
			</div>
			<script type="text/javascript">
				doResults('<xsl:value-of select="$webserviceurl" />', '<xsl:value-of select="." />');
			</script>
		</div>
	</xsl:template>
	
</xsl:stylesheet>