
const administrativoController = {

    mostrarInicio: (req, res) => {
        res.render('administrativo/index', {
            titulo: 'Panel administrativo',
            descripcion: 'Administra usuarios, empresas, vacantes y contenido de TalentoHub.'
        });
    }

};

module.exports = administrativoController;
