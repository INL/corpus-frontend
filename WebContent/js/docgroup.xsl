<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
	<xsl:template match="Documents">
		<xsl:for-each select="Document">
		<div class="row-fluid ">
			<div class="span10 inline-concordance"><b><xsl:value-of select="title" /></b></div>
			<div class="span2 inline-concordance">Hits: <xsl:value-of select="HitsInDoc" /></div>
		</div>
		</xsl:for-each>
	</xsl:template>
</xsl:stylesheet>