<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
	<!-- How to transform a concordance (snippet) to HTML -->
	
    <!-- NB can be removed when we go fully single-page. -->
    
	<xsl:template match="error">
	   <div class='error'>
	       <xsl:apply-templates />
	   </div>
	</xsl:template>
	
	<xsl:template match="blacklabResponse">
		<xsl:value-of select="left" /><b><xsl:value-of select="match" /></b><xsl:value-of select="right" />
	</xsl:template>
</xsl:stylesheet>