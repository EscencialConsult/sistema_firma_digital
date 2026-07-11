export interface SharedSignedPdfLink {
  title: string;
  fileName: string;
  url: string;
  ownerEmail?: string;
}

export function buildSignedPdfsEmail(input: {
  documents: SharedSignedPdfLink[];
  senderLabel?: string;
}) {
  const count = input.documents.length;
  const subject = count === 1
    ? `Envio de documento firmado disponible | ${input.documents[0].title}`
    : `Envio de documentos firmados disponibles | ${count} archivos`;

  const intro = count === 1
    ? "Te compartimos el siguiente documento firmado para que puedas descargarlo desde el portal."
    : "Te compartimos los siguientes documentos firmados para que puedas descargarlos desde el portal.";

  const line = "------------------------------------------------------------";
  const documentBlocks = input.documents.map((document, index) => [
    line,
    `Documento ${index + 1} de ${count}`,
    "",
    `Archivo:    ${document.fileName}`,
    `Titulo:     ${document.title}`,
    ...(document.ownerEmail ? [`Referencia: ${document.ownerEmail}`] : []),
    "",
    `Descargar PDF firmado:`,
    document.url,
  ].join("\n"));

  const body = [
    "Hola,",
    "",
    intro,
    "",
    ...documentBlocks,
    line,
    "",
    "Importante:",
    "- Los enlaces abren los PDFs firmados desde el portal.",
    "- Si no esperabas este correo, o no podes abrir algun enlace, responde a este mensaje para que podamos ayudarte.",
    "- Conserva este correo como referencia del envio.",
    "",
    "Saludos,",
    input.senderLabel ?? "Equipo de Firma Digital",
  ].join("\n");

  return { subject, body };
}
