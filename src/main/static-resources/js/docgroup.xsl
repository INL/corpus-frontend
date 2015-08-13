<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
	<!-- How to transform doc results to HTML -->
	
    <!-- NB can be removed when we go fully single-page. -->
    
    <xsl:template match="summary" />
    
	<xsl:template match="docs/doc">
		<div class="row-fluid ">
			<div class="span10 inline-concordance"><b><xsl:value-of select="docInfo/title" /></b></div>
			<div class="span2 inline-concordance">Hits: <xsl:value-of select="numberOfHits" /></div>
		</div>
	</xsl:template>
</xsl:stylesheet>