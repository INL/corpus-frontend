<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" omit-xml-declaration="yes" />
	
	<xsl:template match="Concordance">
		<xsl:value-of select="Left" /><b><xsl:value-of select="Hit" /></b><xsl:value-of select="Right" />
	</xsl:template>
</xsl:stylesheet>