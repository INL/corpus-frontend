<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
	<xsl:template match="Concordances">
		<xsl:for-each select="Concordance">
			<div class="row-fluid ">
				<div class="span5 text-right inline-concordance">... <xsl:value-of select="Left" /></div>
				<div class="span2 text-center inline-concordance"><b><xsl:value-of select="Hit" /></b></div>
				<div class="span5 inline-concordance"><xsl:value-of select="Right" /> ...</div>
			</div>
		</xsl:for-each>
	</xsl:template>
</xsl:stylesheet>