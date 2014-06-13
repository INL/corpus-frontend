<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
    <!-- How to transform hit group results to HTML -->
    
    <xsl:template match="summary|doc-infos" />
    
	<xsl:template match="hits/hit">
			<div class="row-fluid ">
				<div class="span5 text-right inline-concordance">... <xsl:value-of select="left" /></div>
				<div class="span2 text-center inline-concordance"><b><xsl:value-of select="match" /></b></div>
				<div class="span5 inline-concordance"><xsl:value-of select="right" /> ...</div>
			</div>
	</xsl:template>
</xsl:stylesheet>