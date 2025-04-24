import React, { useState, useEffect } from "react";
import {
  Divider,
  Button,
  Text,
  Flex,
  hubspot,
  Heading,
  Link,
  LoadingButton,
} from "@hubspot/ui-extensions";

hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

const Extension = ({ context, runServerless, sendAlert }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCSVDownloadLink, setGeneratedCSVDownloadLink] = useState(null);

  useEffect(async () => {
    fetchLineItemDetails()
  }, [])

  const fetchLineItemDetails = async () => {
    setIsGenerating(true);
    try {
      const { response } = await runServerless({
        name: "initFunc",
        propertiesToSend: ['hs_object_id', 'genarated_line_item_csv']
      });

      if (response?.downloadLink) {
        setGeneratedCSVDownloadLink(response.downloadLink);
      }
    } catch (error) {
      sendAlert({
        message: "Something went wrong",
        type: "danger"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCSV = async () => {
    setIsGenerating(true);
    try {
      const { response } = await runServerless({
        name: "generateCSVFunc",
        propertiesToSend: ['hs_object_id']
      });

      if (response?.downloadLink) {
        setGeneratedCSVDownloadLink(response.downloadLink);
        sendAlert({
          message: "CSV file generated successfully!",
          type: "success"
        });
      } else {
        sendAlert({
          message: "Failed to generate CSV file",
          type: "danger"
        });
      }
    } catch (error) {
      sendAlert({
        message: "Error generating CSV: " + error.message,
        type: "danger"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Heading level={1}>CSV Generator</Heading>
      <Text>This tool allows you to generate and download CSV files.</Text>
      <Flex direction="column" justify="center" align gap="small">
        <LoadingButton loading={isGenerating} onClick={handleGenerateCSV} disabled={isGenerating || !!generatedCSVDownloadLink}>
          {isGenerating ? (
            "Generating..."
          ) : (
            "Generate CSV"
          )}
        </LoadingButton>
        <Link
          href={{
            url: generatedCSVDownloadLink,
            external: true,
          }}
        >
          <Button
            type="button"
            disabled={!generatedCSVDownloadLink}
            variant="primary"
          >
            Download CSV
          </Button>
        </Link>
      </Flex>
      <Divider />
    </>
  );
};