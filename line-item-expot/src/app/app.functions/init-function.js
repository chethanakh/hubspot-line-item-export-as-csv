exports.main = async (context = {}) => {
  const { hs_object_id, genarated_line_item_csv } = context.propertiesToSend;

  return { downloadLink: genarated_line_item_csv != "" ? genarated_line_item_csv : null };
};
